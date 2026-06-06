import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function Navigation() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Navigation</h2>
        <p className="text-sm text-muted-foreground">
          Tabs, Accordion, Dropdown menu avec sous-menu.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full max-w-md">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4 text-sm text-muted-foreground">
          High-level summary of the project.
        </TabsContent>
        <TabsContent value="analytics" className="pt-4 text-sm text-muted-foreground">
          Engagement, retention, conversion.
        </TabsContent>
        <TabsContent value="settings" className="pt-4 text-sm text-muted-foreground">
          Theme, locale, integrations.
        </TabsContent>
      </Tabs>

      <Accordion className="w-full max-w-md">
        <AccordionItem value="a">
          <AccordionTrigger>What is this template?</AccordionTrigger>
          <AccordionContent>
            React + Vite + Tailwind v4 + shadcn (Base UI) + signals, prêt à fork.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>How do I theme it?</AccordionTrigger>
          <AccordionContent>
            Édite <code className="font-mono text-xs">src/styles/globals.css</code> — tous les
            tokens sont oklch.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="c">
          <AccordionTrigger>Where do I add a route?</AccordionTrigger>
          <AccordionContent>
            Dans <code className="font-mono text-xs">src/router.tsx</code>, ajoute un children sous
            la route parent.
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>Actions</DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Invite teammates</DropdownMenuItem>
              <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  )
}

export default Navigation
