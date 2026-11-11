export const Badge = ({ tone = 'info', text, extra }: { tone?: 'info' | 'warn' | 'bad'; text?: string; extra?: boolean }) => <span>{tone}{text}</span>;
