import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MetodologiaPopover({
  titulo,
  children,
  label = "Como isso foi calculado?",
}: {
  titulo: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger data-flat className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent">
        <HelpCircle className="size-3.5" /> {label}
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="start">
        <div className="font-semibold mb-2">{titulo}</div>
        <div className="text-muted-foreground space-y-2 text-xs leading-relaxed">{children}</div>
      </PopoverContent>
    </Popover>
  );
}