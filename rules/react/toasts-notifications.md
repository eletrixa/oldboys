---
rule: react/toasts-notifications
title: Toasts and User Notifications
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [toasts, notifications, user-feedback, sonner, radix-ui, async-operations]
---

# Toasts and User Notifications

Use the standardized toast systems consistently and only for user-action feedback.

---

## Clear description

Applications should use consistent toast notification patterns:

- `useToast` (Radix UI) for standard notifications
- `sonner` for high-performance async operation feedback

Toasts must be predictable, not noisy, and never emitted during render.

---

## Specific guidelines

- **DO** show toasts in response to user intent (submit, save, delete).
- **DO** keep toast copy short and actionable.
- **DO** prefer `sonner` for long async operations (loading -> success/error).
- **DO** map failure results to `destructive` toasts (or `sonner.toast.error`).
- **DON'T** toast in render (or during plain derived state computation).
- **DON'T** toast on every re-render / query refetch.
- **DON'T** show technical stack traces to users.
- **DON'T** use both toast systems for the same event.

---

## Implementation details

- For typical CRUD + form submits:
  - use `useToast()` and `toast({ title, description, variant })`.

- For async workflows:
  - use `sonner` and maintain a single toast lifecycle (loading -> success/error).

- If you need deduping:
  - keep it in the calling handler (e.g., a local flag), not in the component render.

---

## Benefits

- **Better UX**: clear feedback without spam
- **Less flakiness**: fewer side-effects on render
- **Consistent patterns**: predictable error surfaces

---

## Examples

### Correct: `useToast` for form submit

```tsx
import { useToast } from '@app/hooks/core/ui/use-toast';

function ProfileForm() {
  const { toast } = useToast();

  const onSave = async () => {
    const result = await profileService.saveProfile(/* ... */);

    if (result.success) {
      toast({
        title: 'Saved',
        description: 'Your changes have been saved successfully.',
      });
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Failed to save changes. Please try again.',
    });
  };

  return <button onClick={onSave}>Save</button>;
}
```

### Correct: `sonner` for async operation lifecycle

```ts
import { toast } from 'sonner';

async function runCheckout() {
  const t = toast.loading('Preparing payment...');

  try {
    const result = await paymentService.startCheckout();

    if (!result.success) {
      toast.error('Payment could not be started.', { id: t });
      return;
    }

    toast.success('Redirecting to payment...', { id: t });
  } catch {
    toast.error('Something went wrong. Please try again.', { id: t });
  }
}
```

### Incorrect: toast during render

```tsx
function Component({ error }: { error?: Error }) {
  const { toast } = useToast();

  if (error) {
    toast({ variant: 'destructive', title: 'Error' }); // render side-effect
  }

  return <div />;
}
```

### Incorrect: toast spam on every refetch

```ts
useEffect(() => {
  if (query.isSuccess) toast.success('Loaded'); // refetch = spam
}, [query.isSuccess]);
```
