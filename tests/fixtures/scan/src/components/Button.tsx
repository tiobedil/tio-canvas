import * as React from 'react';
import type { ReactNode } from 'react';

type Props = {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 1 | 2 | 3;
  disabled?: boolean;
  label?: string;
  count?: number;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  data?: { a: number };
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'ghost', size = 2, disabled = true, label = 'Go', count = 4, children, onClick }: Props) {
  return <button disabled={disabled} onClick={onClick}>{label}{children}</button>;
}

export const helper = () => 1;
