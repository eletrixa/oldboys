---
rule: react/props-design
title: React Props Design
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [props, component-api, typescript, composition, forwardRef, polymorphic]
---

# React Props Design

Design component APIs with clear, composable, and type-safe props.

---

## Description

Well-designed props make components intuitive to use and maintain. This rule covers patterns for prop naming, composition, children patterns, and creating flexible yet type-safe component APIs.

---

## Specific Guidelines

### DO:
- Use descriptive boolean props with verb prefixes (`isLoading`, `hasError`)
- Accept `className` for styling flexibility
- Use `children` for content composition
- Provide sensible defaults for optional props
- Use discriminated unions for variant props
- Forward refs for interactive elements
- Spread remaining props to root element

### DON'T:
- Use boolean props without verb prefix (`loading` vs `isLoading`)
- Accept style objects when className suffices
- Create props that duplicate HTML attributes
- Use `any` in prop types
- Have more than 7-8 props (split component)
- Mix controlled and uncontrolled patterns

---

## Implementation Details

### Prop Naming Conventions:

```typescript
interface ButtonProps {
  // Boolean states - use is/has/should prefix
  isLoading?: boolean;
  isDisabled?: boolean;
  hasIcon?: boolean;
  
  // Event handlers - use on prefix
  onClick?: () => void;
  onFocus?: () => void;
  
  // Render props - use render prefix
  renderIcon?: () => ReactNode;
  
  // Content
  children: ReactNode;
  
  // Styling - always accept className
  className?: string;
}
```

### Discriminated Union for Variants:

```typescript
type ButtonVariant = 
  | { variant: 'primary' }
  | { variant: 'secondary' }
  | { variant: 'danger'; requireConfirmation?: boolean };

interface ButtonProps extends ButtonVariant {
  children: ReactNode;
  onClick?: () => void;
}
```

---

## Benefits

1. **Predictable API**: Consistent naming across components
2. **Type safety**: Discriminated unions prevent invalid combinations
3. **Flexibility**: className and children enable composition
4. **Discoverability**: IDE autocomplete shows all options
5. **Maintainability**: Clear contracts between components

---

## Examples

### Correct: Well-designed component props

```typescript
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-md font-medium',
          variantStyles[variant],
          sizeStyles[size],
          isLoading && 'opacity-70 cursor-wait',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Spinner className="mr-2" size={size} />
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        
        {children}
        
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);
```

### Correct: Compound component pattern

```typescript
interface CardProps {
  children: ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: ReactNode;
  action?: ReactNode;
}

function Card({ children, className }: CardProps) {
  return (
    <div className={clsx('rounded-lg border bg-card shadow-sm', className)}>
      {children}
    </div>
  );
}

function CardHeader({ children, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 pb-4">
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

function CardBody({ children, className }: CardProps) {
  return <div className={clsx('p-6 pt-0', className)}>{children}</div>;
}

function CardFooter({ children, className }: CardProps) {
  return (
    <div className={clsx('flex items-center p-6 pt-0', className)}>
      {children}
    </div>
  );
}

// Attach subcomponents
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };

// Usage
<Card>
  <Card.Header action={<Button size="sm">Edit</Button>}>
    <h2>User Profile</h2>
  </Card.Header>
  <Card.Body>
    <p>Content here</p>
  </Card.Body>
  <Card.Footer>
    <Button>Save</Button>
  </Card.Footer>
</Card>
```

### Correct: Polymorphic component

```typescript
type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicProps<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

interface TextOwnProps {
  variant?: 'body' | 'heading' | 'caption';
  color?: 'default' | 'muted' | 'error';
}

type TextProps<C extends React.ElementType = 'p'> = PolymorphicProps<C, TextOwnProps>;

export function Text<C extends React.ElementType = 'p'>({
  as,
  variant = 'body',
  color = 'default',
  className,
  children,
  ...props
}: TextProps<C>) {
  const Component = as || 'p';
  
  return (
    <Component
      className={clsx(
        variantStyles[variant],
        colorStyles[color],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

// Usage
<Text>Default paragraph</Text>
<Text as="h1" variant="heading">Heading</Text>
<Text as="span" variant="caption" color="muted">Small text</Text>
<Text as="a" href="/link">Link text</Text>
```

### Correct: Controlled vs uncontrolled

```typescript
interface InputProps {
  // Support both controlled and uncontrolled
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  
  // Common props
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function Input({
  value,
  defaultValue,
  onChange,
  ...props
}: InputProps) {
  // Determine if controlled
  const isControlled = value !== undefined;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };
  
  return (
    <input
      {...(isControlled ? { value } : { defaultValue })}
      onChange={handleChange}
      {...props}
    />
  );
}
```

### Incorrect: Poor prop naming

```typescript
// BAD: Unclear prop names
interface BadButtonProps {
  loading: boolean;        // Should be isLoading
  disable: boolean;        // Should be isDisabled
  click: () => void;       // Should be onClick
  txt: string;             // Should be label or children
  clsName: string;         // Should be className
}

// GOOD: Clear, consistent naming
interface ButtonProps {
  isLoading?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}
```

### Incorrect: Too many props

```typescript
// BAD: Component does too much
interface BadComponentProps {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageAlt: string;
  buttonText: string;
  buttonVariant: 'primary' | 'secondary';
  onButtonClick: () => void;
  secondaryButtonText: string;
  onSecondaryClick: () => void;
  showBadge: boolean;
  badgeText: string;
  badgeColor: string;
  // ... more props
}

// GOOD: Split into composable components
interface CardProps {
  children: ReactNode;
  className?: string;
}

// Use composition instead
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Badge>New</Badge>
  </Card.Header>
  <Card.Body>Description</Card.Body>
  <Card.Footer>
    <Button onClick={onPrimary}>Primary</Button>
    <Button variant="secondary" onClick={onSecondary}>Secondary</Button>
  </Card.Footer>
</Card>
```

### Incorrect: Duplicating HTML attributes

```typescript
// BAD: Reinventing HTML
interface BadInputProps {
  inputType: 'text' | 'email' | 'password'; // Just use type
  placeholderText: string;                   // Just use placeholder
  maxLength: number;                         // Already exists
  isReadOnly: boolean;                       // Just use readOnly
}

// GOOD: Extend HTML props
interface InputProps extends ComponentPropsWithoutRef<'input'> {
  // Only add custom props
  hasError?: boolean;
  helperText?: string;
}
```
