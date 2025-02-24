import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {}
export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}
export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}
export interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {}
export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}
export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}
export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {}

export declare const Table: React.ForwardRefExoticComponent<TableProps>;
export declare const TableHeader: React.ForwardRefExoticComponent<TableHeaderProps>;
export declare const TableBody: React.ForwardRefExoticComponent<TableBodyProps>;
export declare const TableFooter: React.ForwardRefExoticComponent<TableFooterProps>;
export declare const TableRow: React.ForwardRefExoticComponent<TableRowProps>;
export declare const TableHead: React.ForwardRefExoticComponent<TableHeadProps>;
export declare const TableCell: React.ForwardRefExoticComponent<TableCellProps>;
export declare const TableCaption: React.ForwardRefExoticComponent<TableCaptionProps>; 