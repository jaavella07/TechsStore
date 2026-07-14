import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';

const makeContext = (): ExecutionContext => ({
  getHandler: jest.fn(),
  getClass:   jest.fn(),
  switchToHttp: jest.fn(),
} as unknown as ExecutionContext);

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate()', () => {
    it('permite el acceso sin validar el JWT cuando la ruta es @Public()', () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(makeContext());

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
    });

    it('delega en la validación JWT de passport cuando la ruta no es pública', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
      const superSpy = jest.spyOn(parentProto, 'canActivate').mockReturnValue(true);

      const result = guard.canActivate(makeContext());

      expect(superSpy).toHaveBeenCalled();
      expect(result).toBe(true);
      superSpy.mockRestore();
    });
  });

  describe('handleRequest()', () => {
    it('lanza UnauthorizedException si no hay usuario', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
    });

    it('propaga el error original si passport reporta uno', () => {
      const err = new Error('token expirado');
      expect(() => guard.handleRequest(err, null)).toThrow(err);
    });

    it('retorna el usuario cuando la validación es exitosa', () => {
      const user = { id: 'user-1' };
      expect(guard.handleRequest(null, user)).toBe(user);
    });
  });
});
