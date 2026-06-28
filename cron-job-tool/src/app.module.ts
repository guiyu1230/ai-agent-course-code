import { Module, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { Job } from './job/entities/job.entity';
import { CronExpression, ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { JobModule } from './job/job.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '123456',
      database: 'hello',
      synchronize: true,
      // connectorPackage: 'mysql2',
      logging: true,
      entities: [User, Job]
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    AiModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: Number(configService.get('MAIL_PORT')),
          secure: configService.get('MAIL_SECURE') === 'true',
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASS'),
          },
        },
        defaults: {
          from: configService.get('MAIL_FROM')
        }
      })
    }),
    UsersModule,
    JobModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {

  @Inject(SchedulerRegistry)
  schedulerRegistry: SchedulerRegistry;

  async onApplicationBootstrap() {
    const job = new CronJob(CronExpression.EVERY_SECOND, () => {
      console.log('run job');
    });
    this.schedulerRegistry.addCronJob('job1', job);
    job.start();
    setTimeout(() => {
      this.schedulerRegistry.deleteCronJob('job1');
      job.stop();
    }, 5000);

    const intervalRef = setInterval(() => {
      console.log('run interval job');
    }, 1000)
    this.schedulerRegistry.addInterval('interval1', intervalRef);
    setTimeout(() => {
      this.schedulerRegistry.deleteInterval('interval1');
      clearInterval(intervalRef);
    }, 5000);

    const timeoutRef = setTimeout(() => {
      console.log('run timeout job');
    }, 3000);
    this.schedulerRegistry.addTimeout('timeout1', timeoutRef);
    setTimeout(() => {
      this.schedulerRegistry.deleteTimeout('timeout1');
      clearTimeout(timeoutRef);
    }, 5000);
  }
}
