'use client';

import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  Autoformat,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
} from 'ckeditor5';

import 'ckeditor5/ckeditor5.css';

import { cn } from '@/lib/utils';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  /** Merged onto the wrapper — e.g. to let the editor stretch and fill a
   *  flex column instead of the default capped height. */
  className?: string;
};

/** CKEditor 5, dynamically imported by `rich-text-editor.tsx` so it never
 *  runs during SSR (it touches the DOM at load time). Content is stored as
 *  HTML rather than a PDF so policy updates can carry a real changelog and
 *  render in-app instead of requiring a re-upload for every edit. */
export function RichTextEditorImpl({
  value,
  onChange,
  disabled,
  className,
}: RichTextEditorProps) {
  return (
    <div
      className={cn(
        'rich-text-editor min-w-0 max-w-full rounded-md border border-input [&_.ck-toolbar]:rounded-t-md [&_.ck-toolbar]:border-0 [&_.ck-toolbar]:border-b [&_.ck-toolbar]:border-input',
        className,
      )}
    >
      <CKEditor
        editor={ClassicEditor}
        disabled={disabled}
        data={value}
        config={{
          licenseKey: 'GPL',
          plugins: [
            Essentials,
            Paragraph,
            Heading,
            Bold,
            Italic,
            Link,
            List,
            Autoformat,
          ],
          toolbar: [
            'heading',
            '|',
            'bold',
            'italic',
            'link',
            '|',
            'bulletedList',
            'numberedList',
            '|',
            'undo',
            'redo',
          ],
        }}
        onChange={(_event, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
