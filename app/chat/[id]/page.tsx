import ChatClient from "./ChatClient"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata() {
  return { title: "Chat | UniMart" }
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params
  return <ChatClient id={id} />
} 