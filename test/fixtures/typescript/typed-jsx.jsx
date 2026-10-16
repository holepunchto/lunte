export default function Component(props: { title: string }) {
  const label: string = props.title ?? 'Untitled'
  return <section className="component">{label}</section>
}
