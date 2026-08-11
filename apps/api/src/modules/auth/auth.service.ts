import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  health(): string {
    return 'AuthService is healthy';
  }
}
