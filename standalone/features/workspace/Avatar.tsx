import { useState, type ImgHTMLAttributes } from 'react';
import defaultAvatar from '../../../public/img/header-portrait.png';

/** Every profile surface shares validation and a load-error fallback. */
export function Avatar({src, ...props}:ImgHTMLAttributes<HTMLImageElement>) {
  const [failed,setFailed]=useState<string>();
  const candidate=typeof src==='string'&&/^data:image\/(?:png|jpeg|gif);base64,[A-Za-z0-9+/]+=*$/.test(src)?src:defaultAvatar;
  return <img {...props} src={failed===candidate?defaultAvatar:candidate} onError={()=>setFailed(candidate)} />;
}
