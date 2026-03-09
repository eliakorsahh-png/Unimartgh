import GroupChatClient from "./GroupChatClient"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const name = decodeURIComponent(id)
  return { title: `${name} Group Chat | UniMart` }
}

export default async function GroupChatPage({ params }: Props) {
  const { id } = await params
  return <GroupChatClient school={decodeURIComponent(id)} />
}