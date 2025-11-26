import type { FC } from 'react'

type ButtonProps = {
  label: string
}

export const Button: FC<ButtonProps> = ({ label }) => {
  const handleClick = () => {
    console.log(label)
  }
  return (
    <button onClick={handleClick}>
      <span>{label.toUpperCase()}</span>
    </button>
  )
}
