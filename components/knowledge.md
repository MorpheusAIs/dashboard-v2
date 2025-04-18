# Components Knowledge

## Component Organization
- UI components in ui/
- Feature components at root level
- Form components in subnet-form/
- Staking components in staking/
- Metrics components in metrics/

## UI Components
Built on shadcn/ui with custom styling:
- Use the Card component for content containers
- Alert for user notifications
- Dialog for modals
- Form components for data input
- DataTable for tabular data

## Best Practices
- Use TypeScript for all components
- Follow the existing component patterns
- Handle loading and error states
- Use proper prop types
- Include proper accessibility attributes

## State Management
- Use React Context for global state
- Local state with useState for component state
- Form state with react-hook-form
- Network state with wagmi hooks

## Styling
- Use Tailwind CSS for styling
- Follow the existing color scheme
- Use the cn utility for conditional classes
- Maintain responsive design patterns

## Form Handling
- Use react-hook-form for forms
- Implement proper validation
- Handle loading states
- Show proper error messages

## Common Patterns
```tsx
// Component template
export function ComponentName({ prop1, prop2 }: Props) {
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Error state
  const [error, setError] = useState<Error | null>(null);
  
  // Success state
  const [success, setSuccess] = useState(false);
  
  return (
    <div className="component-wrapper">
      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert error={error} />}
      {success && <SuccessMessage />}
      {/* Main content */}
    </div>
  );
}
```