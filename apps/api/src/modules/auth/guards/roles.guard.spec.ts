import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@shared/enums';

const makeContext = (user: any): ExecutionContext => ({
  getHandler: jest.fn(),
  getClass:   jest.fn(),
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn().mockReturnValue({ user }),
  }),
} as unknown as ExecutionContext);

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('permite el acceso a cualquier usuario autenticado cuando el handler no tiene @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(makeContext({ role: UserRole.CLIENT }));

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('lanza ForbiddenException si no hay usuario en el request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el rol del usuario no está autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(makeContext({ role: UserRole.CLIENT }))).toThrow(ForbiddenException);
  });

  it('permite el acceso cuando el rol del usuario está autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.AGENT]);

    const result = guard.canActivate(makeContext({ role: UserRole.AGENT }));

    expect(result).toBe(true);
  });
});
