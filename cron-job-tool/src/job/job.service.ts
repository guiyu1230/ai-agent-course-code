import {  Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EntityManager } from 'typeorm';
import { Job } from './entities/job.entity'

@Injectable()
export class JobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobService.name);

  @Inject(SchedulerRegistry)
  private readonly schedulerRegistry: SchedulerRegistry;

  @Inject(EntityManager)
  private readonly entityManager: EntityManager;

  async onApplicationBootstrap() {
    const enabledJobs = await this.entityManager.find(Job, {
      where: {  isEnabled: true }
    });
    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervals = this.schedulerRegistry.getIntervals();
    const timeouts = this.schedulerRegistry.getTimeouts();

    for(const job of enabledJobs) {
      const alreadyRegistered = 
        (job.type === 'cron' && cronJobs.has(job.id)) ||
        (job.type === 'every' && intervals.includes(job.id)) ||
        (job.type === 'at' && timeouts.includes(job.id ));
      if (alreadyRegistered) continue;

      await this.startRuntime(job);
    }
  }

  async listJobs() {
    const jobs = await this.entityManager.find(Job, {
      order: {  createdAt: 'DESC' }
    });

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervals = this.schedulerRegistry.getIntervals();
    const timeouts = this.schedulerRegistry.getTimeouts();

    return jobs.map(job => {
      const running =
        job.isEnabled &&
        ((job.type === 'cron' && cronJobs.has(job.id)) ||
        (job.type === 'every' && intervals.includes(job.id)) ||
        (job.type === 'at' && timeouts.includes(job.id )));

      return {
        ...job,
        running
      };
    });
  }

  async addJob(
    input:
      | {
          type: 'cron';
          instruction: string;
          cron: string;
          isEnabled?: boolean;
        }
      | {
          type: 'every';
          instruction: string;
          everyMs: number;
          isEnabled?: boolean;
        }
      | {
          type: 'at';
          instruction: string;
          at: Date;
          isEnabled?: boolean;
        },
  ) {

  }

  private async startRuntime(job: Job) {
    
  }
}
