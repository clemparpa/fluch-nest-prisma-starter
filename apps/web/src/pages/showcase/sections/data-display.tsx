import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

function DataDisplay() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Data display</h2>
        <p className="text-sm text-muted-foreground">Badges, avatars, séparateurs.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src="https://i.pravatar.cc/80?img=12" alt="User" />
          <AvatarFallback>CP</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback className="bg-primary text-primary-foreground">JS</AvatarFallback>
        </Avatar>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Horizontal separator</div>
        <div>Above</div>
        <Separator />
        <div>Below</div>
        <div className="text-sm font-medium text-muted-foreground">Vertical separator</div>
        <div className="flex h-6 items-center gap-3">
          <span>Left</span>
          <Separator orientation="vertical" />
          <span>Middle</span>
          <Separator orientation="vertical" />
          <span>Right</span>
        </div>
      </div>
    </section>
  )
}

export default DataDisplay
