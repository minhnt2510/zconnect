import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registration_log')
export class RegistrationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 64 })
  ip: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
