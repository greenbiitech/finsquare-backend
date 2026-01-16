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

@Injectable()
export class PsbWaasService {
  private readonly logger = new Logger(PsbWaasService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private configService: ConfigService) {}

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
