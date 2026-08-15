import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="jarvis-markdown text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className={`block overflow-x-auto rounded-md bg-void px-3 py-2 font-mono text-xs text-ink ${className ?? ""}`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-void px-1 py-0.5 font-mono text-[0.85em] text-accent" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-1.5 max-w-full">{children}</pre>,
          ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>,
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
