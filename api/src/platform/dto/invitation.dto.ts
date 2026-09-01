import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @ApiProperty({
    example: 30,
    required: false,
    description: 'Validity in days.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validDays?: number;
}
