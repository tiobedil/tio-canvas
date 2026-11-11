import { forwardRef, memo } from 'react';
export const Card = forwardRef<HTMLDivElement, { tight?: boolean }>(function Card({ tight }, ref) { return <div ref={ref} />; });
const Inner = memo(({ open }: { open: boolean }) => <i />);
export { Inner as CardInner };
export default function Panel({ title }: { title: string }) { return <section>{title}</section>; }
