import React from 'react'
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <h2>Card Title</h2>
        <p>Card content</p>
      </Card>
    )
    
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild as HTMLElement
    
    expect(card).toHaveClass('rounded-lg', 'border', 'shadow-sm')
  })

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-card-class">Content</Card>
    )
    const card = container.firstChild as HTMLElement
    
    expect(card).toHaveClass('custom-card-class')
  })

  it('passes through HTML attributes', () => {
    const { container } = render(
      <Card data-testid="test-card" id="my-card">
        Content
      </Card>
    )
    const card = container.firstChild as HTMLElement
    
    expect(card).toHaveAttribute('data-testid', 'test-card')
    expect(card).toHaveAttribute('id', 'my-card')
  })

  it('supports onClick handler', () => {
    const handleClick = jest.fn()
    const { container } = render(
      <Card onClick={handleClick}>Clickable Card</Card>
    )
    const card = container.firstChild as HTMLElement
    
    card.click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders with dark mode classes', () => {
    const { container } = render(<Card>Dark mode card</Card>)
    const card = container.firstChild as HTMLElement
    
    // Check for dark mode classes
    expect(card.className).toMatch(/dark:/)
  })
})