import { CircleAlertIcon, InfoIcon, RocketIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

function Feedback() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Feedback</h2>
        <p className="text-sm text-muted-foreground">
          Alert (4 variantes), Sonner toast, Progress, Skeleton.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Alert>
          <RocketIcon />
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>Default alert with informational tone.</AlertDescription>
        </Alert>
        <Alert>
          <InfoIcon />
          <AlertTitle>Info</AlertTitle>
          <AlertDescription>Plain default variant, lighter context.</AlertDescription>
        </Alert>
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Careful</AlertTitle>
          <AlertDescription>
            The default variant rendered with a warning icon — same colors as default.
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Destructive</AlertTitle>
          <AlertDescription>Something went wrong. Try again or contact support.</AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => toast("Event has been created")}>
          Toast (default)
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.success("Saved successfully", { description: "Your changes are live." })
          }
        >
          Toast (success)
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error("Something went wrong", { description: "Please retry." })}
        >
          Toast (error)
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Progress</div>
        <Progress value={33} />
        <Progress value={66} />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Skeleton</div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Feedback
