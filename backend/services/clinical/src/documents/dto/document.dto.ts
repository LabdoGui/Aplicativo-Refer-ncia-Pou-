import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { DOCUMENT_TYPES, type DocumentType, type IssueDocumentRequest } from '@pulso/contracts';

export class IssueDocumentDto implements IssueDocumentRequest {
  @ApiProperty()
  @IsUUID('4')
  attendanceId: string;

  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  type: DocumentType;
}
