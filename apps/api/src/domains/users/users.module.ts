import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { User }           from './entities/user.entity';
import { RefreshToken }   from './entities/refresh-token.entity';
import { UsersService }   from './services/users.service';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule], // TypeOrmModule exportado para que AuthModule acceda a RefreshToken
})
export class UsersModule {}
