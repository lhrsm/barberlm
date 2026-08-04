import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface HelpCategoriesProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function HelpCategories({ categories, selectedId, onSelect }: HelpCategoriesProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      <Button
        variant={selectedId === null ? "gold" : "outline"}
        onClick={() => onSelect(null)}
        className="rounded-xl whitespace-nowrap"
      >
        Todos
      </Button>
      {categories.map((category) => {
        const Icon = (LucideIcons as any)[category.icon] || LucideIcons.BookOpen;
        return (
          <Button
            key={category.id}
            variant={selectedId === category.id ? "gold" : "outline"}
            onClick={() => onSelect(category.id)}
            className="rounded-xl whitespace-nowrap gap-2"
          >
            <Icon size={16} />
            {category.name}
          </Button>
        );
      })}
    </div>
  );
}
