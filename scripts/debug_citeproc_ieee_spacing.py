#!/usr/bin/env python3
"""Diagnose missing author-conjunction spacing in citeproc IEEE output."""

from __future__ import annotations

import json
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from citeproc import Citation
from citeproc import CitationItem
from citeproc import CitationStylesBibliography
from citeproc import CitationStylesStyle
from citeproc import formatter
from citeproc.model import Name
from citeproc.source.json import CiteProcJSON

from scripts.generate_publication_citations import bibtex_to_csl_item

LOG_PATH = Path(
    "/Users/peter/git/centre-for-music-and-science.github.io/.cursor/debug-3d715a.log"
)
SESSION_ID = "3d715a"

TEST_BIBTEX = """@article{cheung2019uncertainty,
  author = {Cheung, V. K. M. and Harrison, P. M. C. and Meyer, L. and Pearce, M. T. and Haynes, J.-D. and Koelsch, S.},
  title = {Uncertainty and surprise jointly predict musical pleasure and amygdala, hippocampus, and auditory cortex activity},
  journal = {Current Biology},
  year = {2019},
  doi = {10.1016/j.cub.2019.09.067}
}"""

TEST_BIBTEX_2_AUTHORS = """@article{twonames,
  author = {Cheung, V. K. M. and Koelsch, S.},
  title = {Two author test},
  journal = {Current Biology},
  year = {2019},
  doi = {10.1016/j.cub.2019.09.067}
}"""

TEST_BIBTEX_3_AUTHORS = """@article{threenames,
  author = {Cheung, V. K. M. and Haynes, J.-D. and Koelsch, S.},
  title = {Three author test},
  journal = {Current Biology},
  year = {2019},
  doi = {10.1016/j.cub.2019.09.067}
}"""


def log_event(
    *,
    run_id: str,
    hypothesis_id: str,
    location: str,
    message: str,
    data: dict,
) -> None:
    payload = {
        "sessionId": SESSION_ID,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False) + "\n")


def render_with(style_name: str, source_item: dict, fmt) -> str:
    source = CiteProcJSON([source_item])
    style = CitationStylesStyle(style_name, validate=False)
    bibliography = CitationStylesBibliography(style, source, fmt)
    bibliography.register(Citation([CitationItem(source_item["id"])]))
    return str(bibliography.bibliography()[0])


def first_author_name_node_attrs(style: CitationStylesStyle) -> dict:
    ns = {"csl": "http://purl.org/net/xbiblio/csl"}
    root = style.xml.getroot()
    node = root.find(
        ".//csl:bibliography//csl:names[@variable='author']//csl:name",
        ns,
    )
    if node is None:
        return {}
    return {
        "and": node.attrib.get("and"),
        "delimiter": node.attrib.get("delimiter"),
        "delimiter-precedes-last": node.attrib.get("delimiter-precedes-last"),
        "initialize-with": node.attrib.get("initialize-with"),
    }


def and_term_text(style: CitationStylesStyle) -> str:
    ns = {"csl": "http://purl.org/net/xbiblio/csl"}
    root = style.xml.getroot()
    term = root.find(".//csl:locale//csl:term[@name='and']", ns)
    if term is not None and term.text:
        return term.text
    # Fall back to global term search if not present in style-local locale block.
    term = root.find(".//csl:term[@name='and']", ns)
    return term.text if term is not None and term.text else ""


def main() -> int:
    run_id = "baseline"
    original_name_process = Name.process
    original_name_join = Name.join

    def traced_name_process(self, item, variable, context=None, sort_options=None, **kwargs):
        if variable == "author":
            get_option = lambda opt: self.get_option(opt, context, sort_options)
            and_mode = get_option("and")
            delimiter = get_option("delimiter")
            delimiter_precedes_last = get_option("delimiter-precedes-last")
            and_term = ""
            if and_mode == "text":
                and_term = self.get_single_term(name="and")
            elif and_mode == "symbol":
                and_term = str(self.preformat("&"))
            # #region agent log
            log_event(
                run_id=run_id,
                hypothesis_id="H6",
                location="scripts/debug_citeproc_ieee_spacing.py:99",
                message="Name.process options for author rendering",
                data={
                    "and_mode": and_mode,
                    "and_term": str(and_term),
                    "delimiter": delimiter,
                    "delimiter_precedes_last": delimiter_precedes_last,
                },
            )
            # #endregion
        return original_name_process(
            self,
            item,
            variable,
            context=context,
            sort_options=sort_options,
            **kwargs,
        )

    Name.process = traced_name_process

    def traced_name_join(self, strings, default_delimiter=""):
        items = list(strings)
        resolved_delimiter = self.get("delimiter", default_delimiter)
        out = original_name_join(self, items, default_delimiter=default_delimiter)
        if len(items) == 2 and items[1] == "":
            # #region agent log
            log_event(
                run_id=run_id,
                hypothesis_id="H9",
                location="scripts/debug_citeproc_ieee_spacing.py:137",
                message="Name.join called for delimiter-precedes-last branch",
                data={
                    "default_delimiter": default_delimiter,
                    "resolved_delimiter": resolved_delimiter,
                    "first_item_tail": str(items[0])[-40:],
                    "output_tail": str(out)[-40:],
                },
            )
            # #endregion
        return out

    Name.join = traced_name_join
    entry_key, item = bibtex_to_csl_item(
        TEST_BIBTEX,
        "https://doi.org/10.1016/j.cub.2019.09.067",
        False,
        "2019",
    )
    if item.get("id") != entry_key:
        item["id"] = entry_key

    style = CitationStylesStyle("ieee", validate=False)
    raw_plain = render_with("ieee", item, formatter.plain)
    raw_html = render_with("ieee", item, formatter.html)
    Name.process = original_name_process
    Name.join = original_name_join

    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H1",
        location="scripts/debug_citeproc_ieee_spacing.py:103",
        message="CSL item author payload before rendering",
        data={"authors": item.get("author", []), "author_count": len(item.get("author", []))},
    )
    # #endregion

    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H2",
        location="scripts/debug_citeproc_ieee_spacing.py:114",
        message="IEEE name-node attributes and term text",
        data={
            "name_node_attrs": first_author_name_node_attrs(style),
            "and_term": and_term_text(style),
        },
    )
    # #endregion

    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H3",
        location="scripts/debug_citeproc_ieee_spacing.py:127",
        message="Raw plain formatter output",
        data={"raw_plain": raw_plain, "contains_haynesand": "Haynesand" in raw_plain},
    )
    # #endregion

    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H4",
        location="scripts/debug_citeproc_ieee_spacing.py:137",
        message="Raw html formatter output",
        data={"raw_html": raw_html, "contains_haynesand": "Haynesand" in raw_html},
    )
    # #endregion

    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H7",
        location="scripts/debug_citeproc_ieee_spacing.py:181",
        message="Spacing anomaly detection summary",
        data={
            "plain_has_missing_space": "Haynesand S." in raw_plain,
            "html_has_missing_space": "Haynesand S." in raw_html,
            "index_spacing_missing": raw_html.startswith("[1]V."),
        },
    )
    # #endregion
    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H8",
        location="scripts/debug_citeproc_ieee_spacing.py:194",
        message="Delimiter-precedes-last bug signature",
        data={
            "signature_present": ", J.-D. Haynesand S." in raw_html,
            "expected_when_delimiter_precedes_last_true_and_name_delimiter_empty": True,
        },
    )
    # #endregion

    def render_raw_html_from_bibtex(bibtex_blob: str, year: str) -> str:
        key, source_item = bibtex_to_csl_item(
            bibtex_blob,
            "https://doi.org/10.1016/j.cub.2019.09.067",
            False,
            year,
        )
        if source_item.get("id") != key:
            source_item["id"] = key
        return render_with("ieee", source_item, formatter.html)

    out_2 = render_raw_html_from_bibtex(TEST_BIBTEX_2_AUTHORS, "2019")
    out_3 = render_raw_html_from_bibtex(TEST_BIBTEX_3_AUTHORS, "2019")
    # #region agent log
    log_event(
        run_id=run_id,
        hypothesis_id="H10",
        location="scripts/debug_citeproc_ieee_spacing.py:239",
        message="Scenario matrix for author count",
        data={
            "two_authors_output": out_2,
            "three_authors_output": out_3,
            "two_authors_has_missing_space": "and" in out_2 and " and " not in out_2,
            "three_authors_has_missing_space": "and" in out_3 and " and " not in out_3,
        },
    )
    # #endregion
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
