import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const frameworks = ["Next.js", "Remix", "SvelteKit", "Nuxt", "Astro"] as const

function Form() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Form</h2>
        <p className="text-sm text-muted-foreground">
          Inputs, sélecteurs, contrôles binaires — états default / disabled / invalid.
        </p>
      </div>

      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="form-email">Email</FieldLabel>
            <Input id="form-email" type="email" placeholder="name@example.com" />
            <FieldDescription>We'll never share your email.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="form-email-invalid">Email (invalid)</FieldLabel>
            <Input id="form-email-invalid" type="email" defaultValue="not-an-email" aria-invalid />
          </Field>
          <Field>
            <FieldLabel htmlFor="form-disabled">Disabled</FieldLabel>
            <Input id="form-disabled" placeholder="Disabled" disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor="form-bio">Bio</FieldLabel>
            <Textarea id="form-bio" rows={3} placeholder="Tell us about you…" />
          </Field>
          <Field>
            <FieldLabel htmlFor="form-fruit">Favorite fruit</FieldLabel>
            <Select>
              <SelectTrigger id="form-fruit" className="w-full">
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="apple">Apple</SelectItem>
                  <SelectItem value="banana">Banana</SelectItem>
                  <SelectItem value="blueberry">Blueberry</SelectItem>
                  <SelectItem value="grapes">Grapes</SelectItem>
                  <SelectItem value="pineapple">Pineapple</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="form-framework">Framework (combobox)</FieldLabel>
            <Combobox items={frameworks}>
              <ComboboxInput id="form-framework" placeholder="Search…" />
              <ComboboxContent>
                <ComboboxEmpty>No match.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </div>

        <Field orientation="horizontal">
          <Checkbox id="form-tos" />
          <FieldLabel htmlFor="form-tos">I agree to the terms of service</FieldLabel>
        </Field>

        <Field>
          <FieldLabel>Plan</FieldLabel>
          <RadioGroup defaultValue="pro" name="plan" className="flex gap-4">
            <Field orientation="horizontal">
              <RadioGroupItem id="plan-free" value="free" />
              <FieldLabel htmlFor="plan-free">Free</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem id="plan-pro" value="pro" />
              <FieldLabel htmlFor="plan-pro">Pro</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem id="plan-team" value="team" />
              <FieldLabel htmlFor="plan-team">Team</FieldLabel>
            </Field>
          </RadioGroup>
        </Field>

        <Field orientation="horizontal">
          <Switch id="form-notif" defaultChecked />
          <FieldLabel htmlFor="form-notif">Email notifications</FieldLabel>
        </Field>

        <Field>
          <Label htmlFor="form-volume">Volume</Label>
          <Slider id="form-volume" defaultValue={[50]} max={100} step={1} />
        </Field>
      </FieldGroup>
    </section>
  )
}

export default Form
