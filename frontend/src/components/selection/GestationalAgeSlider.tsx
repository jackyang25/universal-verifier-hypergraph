import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type GestationalAgeSliderProps = {
  value: number;
  marks: number[];
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function GestationalAgeSlider({
  value,
  marks,
  min,
  max,
  onChange
}: GestationalAgeSliderProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Gestational Age</CardTitle>
        <CardDescription>{value} weeks</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <input
          className="semantic-slider w-full"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="mt-2 grid grid-cols-5 text-xs text-slate-500">
          {marks.map((mark, index) => (
            <span
              key={mark}
              className={[
                index === 0
                  ? "text-left"
                  : index === marks.length - 1
                    ? "text-right"
                    : "text-center",
                index <= 1
                  ? "text-amber-600"
                  : index >= marks.length - 2
                    ? "text-emerald-600"
                    : "text-slate-500"
              ].join(" ")}
            >
              {mark}w
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
