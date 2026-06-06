import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function Overlays() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Overlays</h2>
        <p className="text-sm text-muted-foreground">
          Dialog, Sheet, Drawer, Popover, Tooltip — déclencheurs et contenus.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
              <DialogDescription>
                Modal centré. Ferme en cliquant en dehors ou via Escape.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>Open Sheet</SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Sheet</SheetTitle>
              <SheetDescription>Panneau coulissant depuis le côté.</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Drawer</DrawerTitle>
              <DrawerDescription>Tiroir qui monte depuis le bas — mobile-first.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button>Done</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Open Popover</PopoverTrigger>
          <PopoverContent className="w-72 space-y-1.5">
            <PopoverTitle>Popover</PopoverTitle>
            <PopoverDescription>
              Floating panel ancré à son trigger. Utile pour menus inline.
            </PopoverDescription>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Hover for tooltip</TooltipTrigger>
            <TooltipContent>Short helper text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </section>
  )
}

export default Overlays
