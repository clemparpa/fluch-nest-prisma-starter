import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UserResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  email!: string

  @ApiProperty()
  name!: string

  @ApiPropertyOptional({ nullable: true })
  image!: string | null

  @ApiProperty({ example: 'user' })
  role!: string

  @ApiProperty()
  createdAt!: Date
}
