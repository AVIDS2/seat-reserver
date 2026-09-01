import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { LoginResponseDto } from '../auth/dto/login-response.dto';
import { AuthEmailLoginDto } from '../auth/dto/auth-email-login.dto';
import { UsersService } from '../users/users.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { JwtRefreshPayloadType } from '../auth/strategies/types/jwt-refresh-payload.type';
import { PlatformInvitationsService } from './platform-invitations.service';
import { PlatformRegisterDto, PlatformLoginDto } from './dto/platform-auth.dto';
import { PlatformProfileDto } from './dto/platform-profile.dto';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

@ApiTags('Platform Auth')
@Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
@Controller({ path: 'platform/auth', version: '1' })
export class PlatformAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly invitations: PlatformInvitationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  async register(
    @Body() dto: PlatformRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const email = dto.email.toLowerCase();
    const created = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('platform-registration'))`,
      );
      const users = manager.getRepository(UserEntity);
      const existing = await users.findOne({ where: { email } });
      if (existing) throw new BadRequestException('邮箱已注册');
      const firstUser = (await users.count()) === 0;
      if (!firstUser) {
        if (!dto.inviteCode) throw new BadRequestException('邀请码不能为空');
        await this.invitations.consumeWithinTransaction(
          manager,
          dto.inviteCode,
        );
      }
      return users.save(
        users.create({
          email,
          password: await bcrypt.hash(dto.password, 12),
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: { id: firstUser ? RoleEnum.admin : RoleEnum.user },
          status: { id: StatusEnum.active },
        }),
      );
    });
    const login = await this.auth.validateLogin({
      email,
      password: dto.password,
    });
    setAuthCookies(response, login);
    return { user: login.user ?? created };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: PlatformLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (user?.status?.id?.toString() !== StatusEnum.active.toString()) {
      throw new BadRequestException('账号不可用');
    }
    const login = await this.auth.validateLogin(dto as AuthEmailLoginDto);
    setAuthCookies(response, login);
    return { user: login.user };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Request() request: RequestWithUser<JwtPayloadType>) {
    return { user: await this.auth.me(request.user) };
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  async updateMe(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: PlatformProfileDto,
  ) {
    return { user: await this.auth.update(request.user, dto) };
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Request() request: RequestWithUser<{ sessionId: number; hash: string }>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.auth.refreshToken(request.user);
    setTokenCookies(response, tokens);
    return { ok: true };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Request() request: RequestWithUser<JwtRefreshPayloadType>,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout({ sessionId: request.user.sessionId });
    clearAuthCookies(response);
  }
}

function setAuthCookies(response: Response, login: LoginResponseDto): void {
  setTokenCookies(response, login);
}

function setTokenCookies(
  response: Response,
  tokens: Pick<LoginResponseDto, 'token' | 'refreshToken' | 'tokenExpires'>,
): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookie('access_token', tokens.token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: new Date(tokens.tokenExpires),
  });
  response.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(response: Response): void {
  response.clearCookie('access_token', { path: '/' });
  response.clearCookie('refresh_token', { path: '/' });
}
