import { useState, type ImgHTMLAttributes } from 'react';
import defaultAvatar from '../../../public/img/header-portrait.png';

function importedAvatar(src: string | undefined) {
  const match = src?.trim().match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,([^,]+)$/is);
  if (!match) return;
  const payload = match[2].replace(/[\t\n\f\r ]/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return;
  const mime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  return `data:${mime};base64,${payload}`;
}

/** Every profile surface shares validation and a load-error fallback. */
export function Avatar({src, ...props}:ImgHTMLAttributes<HTMLImageElement>) {
  const [failed,setFailed]=useState<string>();
  const candidate=importedAvatar(src)??defaultAvatar;
  return <img {...props} src={failed===candidate?defaultAvatar:candidate} onError={()=>setFailed(candidate)} />;
}
