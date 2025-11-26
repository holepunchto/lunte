import type { FC } from 'react'

type Props = { label: string }

const Button: FC<Props> = ({ label }) => <button>{label}</button>

export default Button
