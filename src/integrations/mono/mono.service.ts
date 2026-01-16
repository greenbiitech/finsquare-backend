import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface MonoBvnInitiateResponse {
  status: string;
  message: string;
  data: {
    session_id: string;
    methods: string[];
  };
}

export interface MonoBvnVerifyResponse {
  status: string;
  message: string;
  data: {
    status: string;
  };
}

export interface MonoBvnDetailsResponse {
  status: string;
  message: string;
  data: {
    first_name: string;
    middle_name: string;
    last_name: string;
    gender: string;
    // Mono returns 'dob' with scope='identity', 'date_of_birth' without scope
    dob?: string;
    date_of_birth?: string;
    // Mono returns 'phone_number' with scope='identity', 'phone_number1' without scope
    phone_number?: string;
    phone_number1?: string;
    phone_number2?: string;
    email: string;
    residential_address: string;
    state_of_residence: string;
    lga_of_residence: string;
    image: string;
    bvn: string;
    enrollment_bank: string;
    enrollment_branch: string;
    level_of_account: string;
    name_on_card: string;
    nationality: string;
    nin: string;
    registration_date: string;
    state_of_origin: string;
    title: string;
    watch_listed: string;
  };
}

export interface MonoErrorResponse {
  status: string;
  message: string;
}

@Injectable()
export class MonoService {
  private readonly logger = new Logger(MonoService.name);
  private readonly baseUrl = 'https://api.withmono.com/v2/lookup/bvn';

  constructor(private configService: ConfigService) {}

  private getSecretKey(): string {
    const secretKey = this.configService.get<string>('MONO_SECRET_KEY');
    if (!secretKey) {
      throw new Error('MONO_SECRET_KEY not configured');
    }
    return secretKey;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'mono-sec-key': this.getSecretKey(),
    };
  }

  /**
   * Step 1: Initiate BVN lookup
   * Submit BVN to get session_id and available verification methods
   */
  async initiateBvnLookup(bvn: string): Promise<MonoBvnInitiateResponse> {
    try {
      this.logger.log(`Initiating BVN lookup for BVN: ${bvn.substring(0, 4)}****`);

      const response = await axios.post<MonoBvnInitiateResponse>(
        `${this.baseUrl}/initiate`,
        { bvn, scope: 'identity' },
        { headers: this.getHeaders() },
      );

      this.logger.log(`BVN initiate successful, session_id: ${response.data.data.session_id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'initiateBvnLookup');
    }
  }

  /**
   * Step 2: Verify BVN with selected method
   * Select verification method and triggers OTP sending
   * Note: session_id is passed via x-session-id header per Mono API docs
   */
  async verifyBvn(sessionId: string, method: string): Promise<MonoBvnVerifyResponse> {
    try {
      this.logger.log(`Verifying BVN with method: ${method}, session_id: ${sessionId}`);

      const response = await axios.post<MonoBvnVerifyResponse>(
        `${this.baseUrl}/verify`,
        { method },
        {
          headers: {
            ...this.getHeaders(),
            'x-session-id': sessionId,
          },
        },
      );

      this.logger.log(`BVN verify response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'verifyBvn');
    }
  }

  /**
   * Step 3: Get BVN details with OTP
   * Submit OTP to retrieve full identity data
   * Note: session_id is passed via x-session-id header per Mono API docs
   */
  async getBvnDetails(sessionId: string, otp: string): Promise<MonoBvnDetailsResponse> {
    try {
      this.logger.log(`Getting BVN details with OTP for session_id: ${sessionId}`);

      const response = await axios.post<MonoBvnDetailsResponse>(
        `${this.baseUrl}/details`,
        { otp },
        {
          headers: {
            ...this.getHeaders(),
            'x-session-id': sessionId,
          },
        },
      );

      this.logger.log(`BVN details retrieved successfully for: ${response.data.data.first_name}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getBvnDetails');
    }
  }

  private handleError(error: unknown, method: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<MonoErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || axiosError.message;
      const statusCode = axiosError.response?.status || 500;

      this.logger.error(`Mono ${method} failed: ${errorMessage} (${statusCode})`);

      throw {
        statusCode,
        message: errorMessage,
        monoError: true,
      };
    }

    this.logger.error(`Mono ${method} failed with unknown error:`, error);
    throw {
      statusCode: 500,
      message: 'An unexpected error occurred',
      monoError: true,
    };
  }
}
