import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Loader2, Mic, Paperclip, Send, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readUploadedConversationFile, UPLOAD_ACCEPT } from "@/lib/readUploadedConversationFile";
import { warmCoachLlm } from "@/lib/warmCoachLlm";
import { toast } from "sonner";

interface Props {
  onSend: (message: string) => void;
  onTranscribeAudio?: (blob: Blob, mimeType: string) => Promise<string>;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  disabled?: boolean;
  /** Allow attaching PDF / DOCX / transcript files for the coach to analyse. Default true. */
  allowFileUpload?: boolean;
}

export default function ChatInput({
  onSend,
  onTranscribeAudio,
  voiceEnabled,
  onToggleVoice,
  disabled,
  allowFileUpload = true,
}: Props) {
  const [value, setValue] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = disabled || isTranscribing || isUploading;

  const canUseRecorder =
    typeof window !== "undefined" &&
    !!window.MediaRecorder &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia;

  const handleSend = () => {
    if (!value.trim() || busy) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setIsUploading(true);
    try {
      const messageText = await readUploadedConversationFile(file);
      onSend(messageText);
      toast.success(`Uploaded ${file.name} — coach will analyse it.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read that file.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    if (!onTranscribeAudio || !canUseRecorder || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        if (blob.size === 0) return;
        setIsTranscribing(true);
        try {
          const text = await onTranscribeAudio(blob, "audio/webm");
          if (text.trim()) onSend(text.trim());
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      setRecorder(null);
    }
  };

  const stopRecording = () => {
    if (!recorder) return;
    recorder.stop();
    setIsRecording(false);
    setRecorder(null);
  };

  return (
    <div className="flex gap-2 items-end bg-card border border-border rounded-2xl p-2 shadow-soft">
      {allowFileUpload ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="rounded-xl shrink-0"
            disabled={busy}
            title="Upload PDF, Word, or transcript for the coach to analyse"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={UPLOAD_ACCEPT}
            onChange={(event) => void handleFileChange(event)}
          />
        </>
      ) : null}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => warmCoachLlm("composer_focus")}
        placeholder={isMobile ? "What's on your mind?" : "Describe the situation, or attach a PDF / transcript…"}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm px-2 py-2 outline-none text-foreground placeholder:text-muted-foreground"
        disabled={busy}
      />
      {onTranscribeAudio && canUseRecorder && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={busy}
          className="rounded-xl shrink-0"
          title={isRecording ? "Stop recording" : "Record voice message"}
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
      )}
      {onToggleVoice && (
        <Button
          type="button"
          size="icon"
          variant={voiceEnabled ? "secondary" : "outline"}
          onClick={onToggleVoice}
          disabled={busy}
          className="rounded-xl shrink-0"
          title={voiceEnabled ? "Voice playback on" : "Voice playback off"}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      )}
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!value.trim() || busy}
        className="rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 shrink-0"
        title="Send"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
