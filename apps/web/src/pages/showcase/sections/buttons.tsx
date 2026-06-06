import { ArrowRightIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const
const SIZES = ["sm", "default", "lg"] as const

function Buttons() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Buttons</h2>
        <p className="text-sm text-muted-foreground">
          Matrice variants × sizes, icônes inline, états icon-only et disabled.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Variants × Sizes</h3>
        <div className="space-y-2">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-2">
              {VARIANTS.map((variant) => (
                <Button key={variant} size={size} variant={variant}>
                  {variant}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">With icons</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
          <Button variant="secondary">
            Continue
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Add">
            <PlusIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Add">
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Disabled</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled>Default</Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
          <Button variant="outline" disabled>
            Outline
          </Button>
          <Button variant="destructive" disabled>
            Destructive
          </Button>
        </div>
      </div>
    </section>
  )
}

export default Buttons
