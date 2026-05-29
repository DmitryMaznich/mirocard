import StorySequence from "./StorySequence";

export default function NarrativeRenderer(props) {
  const type = props.task?.type;
  if (type === "story_sequence") return <StorySequence {...props} />;
  return null;
}
