import { Separator } from "@/components/ui/separator"
import Buttons from "./sections/buttons"
import Cards from "./sections/cards"
import DataDisplay from "./sections/data-display"
import Feedback from "./sections/feedback"
import Form from "./sections/form"
import Navigation from "./sections/navigation"
import Overlays from "./sections/overlays"
import Palette from "./sections/palette"
import SignalStore from "./sections/signal-store"
import SpacingRadius from "./sections/spacing-radius"
import Typography from "./sections/typography"

function Showcase() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Showcase</h1>
        <p className="text-muted-foreground">
          Cible visuelle du skill <code className="font-mono text-sm">apply-theme</code> — touche
          tous les tokens. Toggle dark/light dans le header global.
        </p>
      </header>
      <SignalStore />
      <Separator />
      <Palette />
      <Separator />
      <Typography />
      <Separator />
      <SpacingRadius />
      <Separator />
      <Buttons />
      <Separator />
      <Form />
      <Separator />
      <Cards />
      <Separator />
      <Overlays />
      <Separator />
      <Navigation />
      <Separator />
      <Feedback />
      <Separator />
      <DataDisplay />
    </div>
  )
}

export default Showcase
