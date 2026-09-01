import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Audiences, JwtGuard } from '../auth/jwt.guard';
import { UploadsService } from './uploads.service';

/** Matches MAX_MB in admin-web's image-upload.tsx — the client refuses first,
 *  this is the one that actually counts. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Accepted formats and the extension each is stored under. A browser-declared
 * Content-Type is a hint from the uploader, so every entry also carries the
 * magic bytes the file must actually start with.
 */
const IMAGE_TYPES = [
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  // RIFF....WEBP — bytes 8-11 carry the format, so check those separately.
  { mime: 'image/webp', ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

const startsWith = (buf: Buffer, magic: readonly number[]): boolean =>
  magic.every((byte, i) => buf[i] === byte);

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('ADMIN')
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Banner artwork. Held in memory rather than multer's temp dir: the cap is
   * 5 MB, and a buffer is what content-hash naming needs anyway — writing a
   * temp file first only to hash and move it buys nothing.
   */
  @Post('banner')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload banner artwork, returns the URL to store on the banner' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES, files: 1 },
    }),
  )
  async banner(@UploadedFile() file?: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No image was uploaded');

    const type = IMAGE_TYPES.find((t) => t.mime === file.mimetype);
    if (!type) throw new BadRequestException('Use a JPG, PNG or WebP image.');

    // Declared type must match what the bytes actually are — otherwise a file
    // labelled image/png sails into a directory the whole internet can GET.
    const looksRight =
      startsWith(file.buffer, type.magic) &&
      (type.ext !== 'webp' || file.buffer.subarray(8, 12).toString('ascii') === 'WEBP');
    if (!looksRight) throw new BadRequestException("That file isn't really a JPG, PNG or WebP.");

    return this.uploads.saveBuffer('banners', file.buffer, type.ext);
  }
}
