import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface PsbAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface PsbWalletCreateRequest {
  transactionTrackingRef: string;
  lastName: string;
  otherNames: string;
  phoneNo: string;
  gender: number; // 0=Male, 1=Female
  dateOfBirth: string; // Format: "dd/MM/yyyy"
  address: string;
  bvn?: string;
  nin?: string;
  email?: string;
  placeOfBirth?: string;
  accountName?: string;
}

export interface PsbWalletResponse {
  message: string;
  status: string;
  statusCode?: string;
  data: {
    accountNumber?: string;
    accountName?: string;
    bvn?: string;
    customerID?: string;
    [key: string]: any;
  } | null;
}

export interface PsbTransferRequest {
  transaction: {
    reference: string;
  };
  order: {
    amount: string;
    status: string;
    currency: string;
    amountpaid: string;
    description: string;
    country: string;
  };
  customer: {
    account: {
      number: string; // Destination account number
      bank: string; // Destination bank code
      senderbankname: string;
      type: string; // 'STATIC' or 'DYNAMIC'
      senderaccountnumber: string;
      sendername: string;
      name: string; // Destination account name
    };
  };
  merchant: {
    isFee: boolean;
    merchantFeeAccount: string;
    merchantFeeAmount: string;
  };
  transactionType: string; // 'OTHER_BANKS'
  narration: string;
}

export interface PsbDebitCreditRequest {
  accountNo: string;
  totalAmount: string;
  transactionId: string;
  narration: string;
  merchant: {
    isFee: boolean;
    merchantFeeAccount?: string;
    merchantFeeAmount?: string;
  };
}

@Injectable()
export class PsbWaasService {
  private readonly logger = new Logger(PsbWaasService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private configService: ConfigService) { }

  private getConfig() {
    // Use same env var names as old Greencard codebase for compatibility
    const apiUrl = this.configService.get<string>('FINANCE_9PSB_WALLET_API_URL');
    return {
      apiUrl,
      // Auth URL is base URL + /authenticate (same as old implementation)
      authUrl: apiUrl ? `${apiUrl}/authenticate` : undefined,
      username: this.configService.get<string>('FINANCE_9PSB_WALLET_USERNAME'),
      password: this.configService.get<string>('FINANCE_9PSB_WALLET_PASSWORD'),
      clientId: this.configService.get<string>('FINANCE_9PSB_WALLET_CLIENT_ID'),
      clientSecret: this.configService.get<string>('FINANCE_9PSB_WALLET_CLIENT_SECRET'),
    };
  }

  /**
   * Authenticate with 9PSB WAAS API
   * Returns access token for subsequent requests
   */
  async authenticate(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const config = this.getConfig();

    // Debug: Log config (without secrets)
    this.logger.log(`9PSB Config: authUrl=${config.authUrl}, apiUrl=${config.apiUrl}, username=${config.username ? '***set***' : 'NOT SET'}`);

    if (!config.authUrl || !config.username || !config.password) {
      this.logger.error('9PSB credentials not configured!');
      throw {
        statusCode: 500,
        message: '9PSB credentials not configured',
        psbError: true,
      };
    }

    try {
      this.logger.log('Authenticating with 9PSB WAAS...');

      const response = await axios.post<PsbAuthResponse>(
        config.authUrl!,
        {
          username: config.username,
          password: config.password,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.accessToken = response.data.accessToken;
      this.tokenExpiresAt = Date.now() + (response.data.expiresIn * 1000);

      this.logger.log('9PSB WAAS authentication successful');
      return this.accessToken;
    } catch (error) {
      this.handleError(error, 'authenticate');
    }
  }

  /**
   * Create a new wallet/account for a user
   */
  async createWallet(request: PsbWalletCreateRequest): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Creating wallet for: ${request.otherNames} ${request.lastName}`);
      this.logger.log(`Request payload: ${JSON.stringify({ ...request, bvn: request.bvn ? '***' : undefined })}`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/open_wallet`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`9PSB create wallet response: ${JSON.stringify(response.data)}`);

      // Handle "wallet already exists" as a special case - use existing wallet
      if (response.data.status !== 'SUCCESS') {
        // Check if wallet already exists - 9PSB returns the existing wallet details
        const isWalletExists = response.data.message?.toLowerCase().includes('already exists') ||
          response.data.data?.responseCode === '42';

        if (isWalletExists && response.data.data?.accountNumber) {
          this.logger.log(`Wallet already exists for user, using existing: ${response.data.data.accountNumber}`);
          // Return the existing wallet data as success
          return {
            message: 'Using existing wallet',
            status: 'SUCCESS',
            statusCode: '42', // Indicates existing wallet
            data: {
              accountNumber: response.data.data.accountNumber,
              accountName: response.data.data.fullName,
              customerID: response.data.data.customerID,
              existingWallet: true,
            },
          };
        }

        throw {
          statusCode: 400,
          message: response.data.message || 'Failed to create wallet',
          psbError: true,
          response: response.data,
        };
      }

      return response.data;
    } catch (error) {
      this.handleError(error, 'createWallet');
    }
  }

  /**
   * Get wallet/account details including balance
   * Uses wallet_enquiry endpoint from 9PSB WAAS
   */
  async getWalletDetails(accountNo: string): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Fetching wallet details for account: ${accountNo}`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/wallet_enquiry`,
        { accountNo },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Wallet enquiry response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getWalletDetails');
    }
  }

  /**
   * Get wallet transaction history from 9PSB
   * @param accountNumber - Customer's wallet account number
   * @param fromDate - Start date (format: "dd/MM/yyyy" or "yyyy-MM-dd")
   * @param toDate - End date (format: "dd/MM/yyyy" or "yyyy-MM-dd")
   * @param numberOfItems - Number of transactions to fetch
   */
  async getTransactionHistory(
    accountNumber: string,
    fromDate: string,
    toDate: string,
    numberOfItems: number = 50,
  ): Promise<{ status: string; message: string; data?: any[] }> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Fetching transaction history for account: ${accountNumber}, from: ${fromDate}, to: ${toDate}`);

      const response = await axios.post(
        `${config.apiUrl}/wallet_transactions`,
        {
          accountNumber,
          fromDate,
          toDate,
          numberOfItems: numberOfItems.toString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Transaction history response status: ${response.data?.status}`);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(`Transaction history API error - Status: ${error.response.status}, Data:`, error.response.data);
      } else if (error.request) {
        this.logger.error('Transaction history API error - No response received:', error.message);
      } else {
        this.logger.error('Transaction history API error:', error.message);
      }
      return { status: 'FAILED', message: 'Failed to fetch transaction history' };
    }
  }

  /**
   * Transfer funds to other bank
   */
  async transferToOtherBank(request: PsbTransferRequest): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Initiating transfer to other bank: ${request.customer.account.number} (${request.customer.account.bank})`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/wallet_other_banks`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Transfer response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'transferToOtherBank');
    }
  }

  /**
   * Resolve generic bank account
   */
  async resolveAccount(accountNumber: string, bankCode: string): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Resolving account: ${accountNumber} at bank: ${bankCode}`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/other_banks_enquiry`,
        {
          customer: {
            account: {
              number: accountNumber,
              bank: bankCode,
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Account resolution response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'resolveAccount');
    }
  }

  /**
   * Get list of banks
   */
  async getBankList(): Promise<{ status: string; message: string; data?: any[] }> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log('Fetching bank list');

      const response = await axios.get(
        `${config.apiUrl}/get_banks`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'getBankList');
    }
  }

  /**
   * Debit Wallet (Internal/Float)
   */
  async debitWallet(request: PsbDebitCreditRequest): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Debiting wallet: ${request.accountNo}, amount: ${request.totalAmount}`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/debit/transfer`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'debitWallet');
    }
  }

  /**
   * Credit Wallet (Internal/Float)
   */
  async creditWallet(request: PsbDebitCreditRequest): Promise<PsbWalletResponse> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Crediting wallet: ${request.accountNo}, amount: ${request.totalAmount}`);

      const response = await axios.post<PsbWalletResponse>(
        `${config.apiUrl}/credit/transfer`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'creditWallet');
    }
  }

  /**
   * Requery a transaction notification from 9PSB
   * Used to verify webhook transactions
   */
  async requeryNotification(accountNumber: string, sessionId: string): Promise<{ status: string; data?: any }> {
    const config = this.getConfig();
    const token = await this.authenticate();

    try {
      this.logger.log(`Requerying notification for account: ${accountNumber}, session: ${sessionId}`);

      const response = await axios.post(
        `${config.apiUrl}/inflow/requery`,
        { accountNumber, sessionID: sessionId },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Requery response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error('Requery notification failed:', error);
      return { status: 'FAILED' };
    }
  }

  private handleError(error: unknown, method: string): never {
    // Re-throw if it's already our error format
    if ((error as any).psbError) {
      throw error;
    }

    // Log the full error for debugging
    this.logger.error(`9PSB ${method} error:`, error);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const responseData = axiosError.response?.data;
      const errorMessage = responseData?.message || axiosError.message;
      const statusCode = axiosError.response?.status || 500;

      this.logger.error(`9PSB ${method} failed: ${errorMessage} (${statusCode})`);
      this.logger.error(`Response data: ${JSON.stringify(responseData)}`);

      // Special handling for "wallet already exists" in createWallet
      if (method === 'createWallet' && responseData) {
        const isWalletExists = responseData.message?.toLowerCase().includes('already exists') ||
          responseData.data?.responseCode === '42';

        if (isWalletExists && responseData.data?.accountNumber) {
          this.logger.log(`Wallet already exists for user, using existing: ${responseData.data.accountNumber}`);
          // Return the existing wallet data as a special response
          throw {
            statusCode: 200, // Treat as success
            message: 'Using existing wallet',
            psbError: false, // Not an error
            existingWallet: true,
            response: {
              message: 'Using existing wallet',
              status: 'SUCCESS',
              statusCode: '42',
              data: {
                accountNumber: responseData.data.accountNumber,
                accountName: responseData.data.fullName,
                customerID: responseData.data.customerID,
                existingWallet: true,
              },
            },
          };
        }
      }

      throw {
        statusCode,
        message: errorMessage,
        psbError: true,
        response: responseData,
      };
    }

    this.logger.error(`9PSB ${method} failed with unknown error:`, error);
    throw {
      statusCode: 500,
      message: 'An unexpected error occurred with 9PSB',
      psbError: true,
    };
  }
}
