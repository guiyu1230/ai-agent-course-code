
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type JobType = 'cron' | 'every' | 'at';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 指令文本
  @Column({ type: 'text' })
  instruction: string;

  // 任务类型
  @Column({ type: 'varchar', length: 10, default: 'cron' })
  type: JobType;

  // cron类型使用 (Cron 表达式)
  @Column({ type: 'varchar', length: 100, nullable: true})
  cron: string | null;

  // every类型使用 (每多少毫秒执行一次)
  @Column({ type: 'int', nullable: true})
  everyMs: number | null;

  // at类型使用 (具体触发时间点)
  @Column({ type: 'timestamp', nullable: true})
  at: Date | null;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastRun: Date | null;

  @CreateDateColumn({ type: 'timestamp'})
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

/**
 *   CREATE TABLE `job` (`id` varchar(36) NOT NULL, `instruction` text NOT NULL, `type` varchar(10) NOT NULL DEFAULT 'cron', `cron` varchar(100) NULL, `everyMs` int NULL, `at` timestamp NULL, `isEnabled` tinyint NOT NULL DEFAULT 1, `lastRun` timestamp NULL, `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB
 */