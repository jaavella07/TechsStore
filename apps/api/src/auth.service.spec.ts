import { Test, TestingModule }  from '@nestjs/testing';
import { JwtService }            from '@nestjs/jwt';
import { ConfigService }         from '@nestjs/config';
import { getRepositoryToken }    from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';

import { UserRole }              from '../../../shared/enums';
import { User } from './domains/users/entities/user.entity';
import { AuthService } from './modules/auth/auth.service';
import { UsersService } from './domains/users/services/users.service';
import { RefreshToken } from './domains/users/entities/refresh-token.entity';

const mockUser = (): User => {
  const u        = new User();
  u.id           = 'user-uuid-1';
  u.email        = 'test@test.com';
  u.name         = 'Test User';
  u.role         = UserRole.CLIENT;
  u.isActive     = true;
  u.comparePassword = jest.fn().mockResolvedValue(true);
  return u;
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService:   jest.Mocked<JwtService>;

  const mockRefreshTokenRepo = {
    create:              jest.fn(),
    save:                jest.fn(),
    update:              jest.fn(),
    createQueryBuilder:  jest.fn().mockReturnValue({
      where:    jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany:  jest.fn().mockResolvedValue([]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById:    jest.fn(),
            create:      jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get:         jest.fn().mockReturnValue('secret'),
            getOrThrow:  jest.fn().mockReturnValue('secret'),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    authService  = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService   = module.get(JwtService);
    jest.clearAllMocks();
  });

  // ── login ────────────────────────────────────────────────
  describe('login()', () => {
    it('debe retornar tokens cuando las credenciales son válidas', async () => {
      const user = mockUser();
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await authService.login({ email: 'test@test.com', password: 'Password1' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@test.com');
    });

    it('debe lanzar UnauthorizedException cuando el usuario no existe', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(
        authService.login({ email: 'noexiste@test.com', password: 'Pass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException cuando el usuario está desactivado', async () => {
      const inactiveUser = mockUser();
      inactiveUser.isActive = false;
      (usersService.findByEmail as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(
        authService.login({ email: 'test@test.com', password: 'Password1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException cuando la contraseña es incorrecta', async () => {
      const user = mockUser();
      user.comparePassword = jest.fn().mockResolvedValue(false);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);

      await expect(
        authService.login({ email: 'test@test.com', password: 'Wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ───────────────────────────────────────────────
  describe('logout()', () => {
    it('debe revocar todos los tokens del usuario', async () => {
      await authService.logout('user-uuid-1');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { user: { id: 'user-uuid-1' }, revoked: false },
        { revoked: true },
      );
    });
  });
});
