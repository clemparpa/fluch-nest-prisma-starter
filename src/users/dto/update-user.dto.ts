import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ format: 'url' })
  @IsOptional()
  @IsString()
  @IsUrl()
  image?: string
}
