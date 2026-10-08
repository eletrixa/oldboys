---
rule: react/forms-validation
title: React Forms and Validation
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [forms, validation, zod, react-hook-form, accessibility, user-input]
---

# React Forms and Validation

Handle form state and validation with type-safe patterns and clear error feedback.

---

## Description

Forms are a critical part of user interaction. This rule covers patterns for managing form state, validating input with Zod schemas, handling submission, and providing accessible error feedback in React applications.

---

## Specific Guidelines

### DO:
- Use controlled components for form inputs
- Define form schemas with Zod for validation
- Derive TypeScript types from Zod schemas
- Show validation errors inline near the input
- Disable submit button during submission
- Handle both client and server validation errors
- Use React Hook Form for complex forms

### DON'T:
- Use uncontrolled components without refs
- Validate only on submit (validate on blur/change)
- Show all errors at once in an alert box
- Allow double-submission
- Forget to handle network/server errors
- Use manual state for every field (use form library)

---

## Implementation Details

### Zod Schema Pattern:

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof LoginSchema>;
```

### React Hook Form Integration:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    await login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

---

## Benefits

1. **Type safety**: Schema-derived types prevent mismatches
2. **User experience**: Immediate validation feedback
3. **Accessibility**: Error messages linked to inputs
4. **Consistency**: Same schema validates client and server
5. **Maintainability**: Centralized validation logic

---

## Examples

### Correct: Complete form with validation

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const ProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

interface ProfileFormProps {
  initialData?: Partial<ProfileFormData>;
  onSuccess: () => void;
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: ProfileFormData) => {
    setServerError(null);
    
    try {
      await updateProfile(data);
      reset(data); // Reset dirty state
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setServerError('An unexpected error occurred');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <div role="alert" className="text-red-600 mb-4">
          {serverError}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-red-600 text-sm">
              {errors.name.message}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-red-600 text-sm">
              {errors.email.message}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            {...register('bio')}
            aria-invalid={!!errors.bio}
          />
          {errors.bio && (
            <p className="text-red-600 text-sm">{errors.bio.message}</p>
          )}
        </div>
      </div>
      
      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="mt-4"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

### Correct: Form with field array

```typescript
const QuestionSchema = z.object({
  text: z.string().min(1, 'Question is required'),
  options: z.array(z.string().min(1)).min(2, 'At least 2 options required'),
});

const SurveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  questions: z.array(QuestionSchema).min(1, 'At least 1 question required'),
});

type SurveyFormData = z.infer<typeof SurveySchema>;

function SurveyForm() {
  const { register, control, handleSubmit, formState: { errors } } = useForm<SurveyFormData>({
    resolver: zodResolver(SurveySchema),
    defaultValues: {
      title: '',
      questions: [{ text: '', options: ['', ''] }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} placeholder="Survey Title" />
      
      {fields.map((field, index) => (
        <div key={field.id}>
          <input
            {...register(`questions.${index}.text`)}
            placeholder={`Question ${index + 1}`}
          />
          {errors.questions?.[index]?.text && (
            <span>{errors.questions[index]?.text?.message}</span>
          )}
          
          <button type="button" onClick={() => remove(index)}>
            Remove Question
          </button>
        </div>
      ))}
      
      <button type="button" onClick={() => append({ text: '', options: ['', ''] })}>
        Add Question
      </button>
      
      <button type="submit">Create Survey</button>
    </form>
  );
}
```

### Correct: Simple controlled form without library

```typescript
interface SimpleFormState {
  email: string;
  message: string;
}

function ContactForm() {
  const [form, setForm] = useState<SimpleFormState>({ email: '', message: '' });
  const [errors, setErrors] = useState<Partial<SimpleFormState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<SimpleFormState> = {};
    
    if (!form.email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }
    if (form.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await sendMessage(form);
      setForm({ email: '', message: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        onBlur={validate}
      />
      {errors.email && <span>{errors.email}</span>}
      
      <textarea
        value={form.message}
        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
      />
      {errors.message && <span>{errors.message}</span>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

### Incorrect: No loading/error states

```typescript
// BAD: No feedback during submission
function BadForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveData(formData); // User sees nothing happening!
  };

  return (
    <form onSubmit={handleSubmit}>
      <input />
      <button type="submit">Save</button>
    </form>
  );
}
```

### Incorrect: Uncontrolled without refs

```typescript
// BAD: Can't access or validate values properly
function BadForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // How do we get the values? FormData is clunky
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email'); // string | null - not type safe
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" /> {/* No value binding! */}
    </form>
  );
}
```

### Incorrect: All errors in alert

```typescript
// BAD: Errors far from inputs
function BadForm({ errors }: { errors: string[] }) {
  return (
    <form>
      {errors.length > 0 && (
        <div className="alert alert-danger">
          {errors.map(e => <p key={e}>{e}</p>)}
        </div>
      )}
      <input name="email" /> {/* Which error is for email? */}
      <input name="password" />
    </form>
  );
}
```
