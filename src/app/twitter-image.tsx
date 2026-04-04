import { createSocialImage, socialImageContentType, socialImageSize } from '@/lib/social-image';

export const contentType = socialImageContentType;
export const size = socialImageSize;

export default function TwitterImage() {
    return createSocialImage();
}
