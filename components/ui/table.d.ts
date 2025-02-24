import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export type TableProps = HTMLAttributes<HTMLTableElement>;
export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableFooterProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableRowProps = HTMLAttributes<HTMLTableRowElement>;
export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>;
export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;
export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

export declare const Table: React.ForwardRefExoticComponent<TableProps>;
export declare const TableHeader: React.ForwardRefExoticComponent<TableHeaderProps>;
export declare const TableBody: React.ForwardRefExoticComponent<TableBodyProps>;
export declare const TableFooter: React.ForwardRefExoticComponent<TableFooterProps>;
export declare const TableRow: React.ForwardRefExoticComponent<TableRowProps>;
export declare const TableHead: React.ForwardRefExoticComponent<TableHeadProps>;
export declare const TableCell: React.ForwardRefExoticComponent<TableCellProps>;
export declare const TableCaption: React.ForwardRefExoticComponent<TableCaptionProps>; 