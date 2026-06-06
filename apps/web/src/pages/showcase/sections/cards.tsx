import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function Cards() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Cards</h2>
        <p className="text-sm text-muted-foreground">
          Card vide, card avec header + action, card avec form inline.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Empty card — just content.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>Header, description, action.</CardDescription>
            <CardAction>
              <Button size="sm" variant="outline">
                Edit
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A card with header, action, and content.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscribe</CardTitle>
            <CardDescription>Enter your email to subscribe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="card-email" className="sr-only">
                Email
              </FieldLabel>
              <Input id="card-email" type="email" placeholder="name@example.com" />
            </Field>
          </CardContent>
          <CardFooter>
            <Button size="sm" className="w-full">
              Subscribe
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}

export default Cards
