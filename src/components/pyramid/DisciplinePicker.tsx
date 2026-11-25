import { Segmented } from "../ui";
import { DISCIPLINE_FILTERS } from "../../constants/climbGrades";
import type { DisciplineFilter } from "../../constants/climbGrades";

/** The route views' All / Sport / Trad choice. */
export function DisciplinePicker({
  value,
  onChange,
}: {
  value: DisciplineFilter;
  onChange: (d: DisciplineFilter) => void;
}) {
  return <Segmented label="Route type" options={DISCIPLINE_FILTERS} value={value} onChange={onChange} />;
}
